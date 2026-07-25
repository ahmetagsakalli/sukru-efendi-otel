import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const port = Number(process.env.ADMIN_SMOKE_PORT ?? 3210);
const repeats = Number(process.env.ADMIN_SMOKE_REPEATS ?? 2);
const serverMode = process.env.ADMIN_SMOKE_SERVER ?? "dev";
const baseURL = `http://127.0.0.1:${port}`;
const adminPassword = "sukruefendi1.";
const changedAdminPassword = "sukruefendi2.";
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sukru-admin-smoke-"));
const tmpContentDir = path.join(tmpRoot, "content");
const tmpContentFile = path.join(tmpContentDir, "site-content.json");
const tmpReservationFile = path.join(tmpContentDir, "reservation-requests.json");
const tmpAuthFile = path.join(tmpContentDir, ".admin-auth.json");
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
      const response = await fetch(`${baseURL}/admin/login`, { redirect: "manual" });

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
      background: color
    }
  })
    .png()
    .toFile(filePath);
}

async function setupIsolatedContent() {
  await fs.mkdir(tmpContentDir, { recursive: true });
  await fs.copyFile(path.join(repoRoot, "content", "site-content.json"), tmpContentFile);
}

async function resetSmokeData() {
  await fs.copyFile(path.join(repoRoot, "content", "site-content.json"), tmpContentFile);
  await fs.rm(tmpReservationFile, { force: true });
  await fs.rm(tmpAuthFile, { force: true });
}

async function cleanupUploadedPublicFiles() {
  const publicRoots = [path.join(repoRoot, "public"), path.join(repoRoot, ".next", "standalone", "public")];

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
    ADMIN_PASSWORD: serverMode === "start" ? adminPassword : "",
    ADMIN_PASSWORD_HASH: "",
    ADMIN_SESSION_SECRET: serverMode === "start" ? "admin-smoke-session-secret-2026" : "",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    SITE_CONTENT_DIR: tmpContentDir,
    SITE_CONTENT_FILE: tmpContentFile,
    RESERVATION_REQUESTS_FILE: tmpReservationFile
  };

  const args = serverMode === "start" ? ["start"] : ["dev", "--hostname", "127.0.0.1", "--port", String(port)];
  const server = spawn(pnpmCommand(), args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", rememberServerLog);
  server.stderr.on("data", rememberServerLog);

  await waitForServer();
  return server;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;

  server.kill("SIGINT");

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
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
  expect(assetResponse.status(), `${publicPath} was not served as a public asset`).toBe(200);
}

async function uploadWithPickerRoot(page, root, filePath) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/images") && candidate.request().method() === "POST"),
    root.locator("input[type='file']").setInputFiles(filePath)
  ]);

  expect(response.ok(), `Upload failed with ${response.status()}`).toBeTruthy();
  const json = await response.json();
  assert(json.image?.src, "Upload response did not include image src.");
  uploadedPublicPaths.add(json.image.src);
  await expectUploadedAssetIsServed(page, json.image.src);
  await expect(root.locator("select")).toHaveValue(json.image.src);
  return json.image;
}

async function uploadToLibrary(page, filePath) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/images") && candidate.request().method() === "POST"),
    page.getByTestId("image-library-upload").setInputFiles(filePath)
  ]);

  expect(response.ok(), `Library upload failed with ${response.status()}`).toBeTruthy();
  const json = await response.json();
  assert(json.image?.src, "Library upload response did not include image src.");
  uploadedPublicPaths.add(json.image.src);
  await expectUploadedAssetIsServed(page, json.image.src);
  await expect(page.getByTestId("admin-section-images").getByText(json.image.name, { exact: true })).toBeVisible();
  return json.image;
}

async function loginOrSetup(page, password = adminPassword) {
  await page.goto(`${baseURL}/admin/login`);

  const setupHeading = page.getByRole("heading", { name: "Admin parolası oluştur" });

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
    data: {
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      roomSlug: "suit-oda",
      adults: 2,
      children: 1,
      name: `Smoke Misafir ${iteration}`,
      phone: "+90 555 100 20 30",
      email: " ",
      note: `Smoke rezervasyon ${iteration}`,
      website: ""
    }
  });

  expect(response.ok(), `Reservation request failed with ${response.status()}`).toBeTruthy();
  const json = await response.json();
  assert(json.reservation?.id, "Reservation response did not include an id.");
  assert(json.reservation?.estimatedTotal > 0, "Reservation response did not include a calculated total.");
}

async function checkPublicReservationValidation(page) {
  const availability = await page.request.get(`${baseURL}/api/availability?checkIn=2026-08-01&checkOut=2026-08-03&roomSlug=suit-oda`);
  expect(availability.ok(), `Availability request failed with ${availability.status()}`).toBeTruthy();
  const availabilityJson = await availability.json();
  expect(availabilityJson.rooms?.[0]?.isAvailable).toBe(true);
  assert(availabilityJson.rooms?.[0]?.estimatedTotal > 0, "Availability response did not include a calculated total.");

  const invalidDate = await page.request.post(`${baseURL}/api/reservations`, {
    data: {
      checkIn: "2026-08-03",
      checkOut: "2026-08-01",
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Invalid",
      phone: "+90 555 100 20 30",
      email: "invalid@example.com",
      note: "",
      website: ""
    }
  });

  expect(invalidDate.status()).toBe(400);

  const invalidEmail = await page.request.post(`${baseURL}/api/reservations`, {
    data: {
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Invalid Email",
      phone: "+90 555 100 20 30",
      email: "abc",
      note: "",
      website: ""
    }
  });

  expect(invalidEmail.status()).toBe(400);
  const invalidEmailJson = await invalidEmail.json();
  expect(invalidEmailJson.issues?.[0]?.message).toBe("E-posta adresi geçersiz.");

  const honeypot = await page.request.post(`${baseURL}/api/reservations`, {
    data: {
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Bot",
      phone: "+90 555 100 20 30",
      email: "bot@example.com",
      note: "",
      website: "spam"
    }
  });

  expect(honeypot.status()).toBe(200);
}

async function checkOverview(page, imagePath, iteration) {
  await page.getByTestId("admin-tab-overview").click();
  await expect(page.getByRole("heading", { level: 1, name: "Genel" })).toBeVisible();

  const hotelInfo = page.getByTestId("admin-section-site");
  await hotelInfo.getByLabel("Otel adı").fill(`Smoke Otel ${iteration}`);
  await hotelInfo.getByLabel("Kısa ad").fill(`Smoke ${iteration}`);

  const hero = page.getByTestId("admin-section-home-hero");
  await hero.getByLabel("Başlık").fill(`Smoke Başlık ${iteration}`);
  await hero.getByLabel("Vurgu başlığı").fill("Panel Test");
  await hero.getByLabel("Kısa metin").fill("Admin panel smoke test metni.");
  await uploadWithPicker(page, "image-picker-home-hero", imagePath);
}

async function checkReservations(page, iteration) {
  await createReservation(page, iteration);
  await page.getByTestId("admin-tab-reservations").click();
  await page.getByRole("button", { name: "Yenile" }).click();
  const card = page.locator(".admin-reservation-card").filter({ hasText: `Smoke Misafir ${iteration}` }).first();
  await expect(card).toBeVisible();
  await card.getByLabel("Durum").selectOption("confirmed");
  await card.getByLabel("Telefon").fill("+90 555 200 30 40");
  await card.getByLabel("Admin notu").fill(`Smoke admin notu ${iteration}`);

  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/reservations") && candidate.request().method() === "PATCH"),
    card.getByRole("button", { name: "Rezervasyonu Kaydet" }).click()
  ]);

  expect(response.ok(), `Reservation update failed with ${response.status()}`).toBeTruthy();
  await expect(page.getByText("Rezervasyon güncellendi.")).toBeVisible();

  const createForm = page.getByTestId("admin-create-reservation-form");
  await createForm.getByLabel("Giriş").fill("2026-08-01");
  await createForm.getByLabel("Çıkış").fill("2026-08-03");
  await createForm.getByLabel("Oda").selectOption("suit-oda");
  await createForm.getByLabel("Kayıt durumu").selectOption("confirmed");
  await createForm.getByLabel("Ad Soyad").fill(`Suite Blokaj ${iteration}`);
  await createForm.getByLabel("Telefon").fill("+90 555 250 30 40");

  const [blockerResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/reservations") && candidate.request().method() === "POST"),
    page.getByTestId("admin-create-reservation").click()
  ]);

  expect(blockerResponse.ok(), `Second confirmed reservation failed with ${blockerResponse.status()}`).toBeTruthy();

  const overbooked = await page.request.post(`${baseURL}/api/reservations`, {
    data: {
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Overbook",
      phone: "+90 555 999 88 77",
      email: "",
      note: "",
      website: ""
    }
  });
  expect(overbooked.status()).toBe(409);

  await createForm.getByLabel("Giriş").fill("2026-08-10");
  await createForm.getByLabel("Çıkış").fill("2026-08-12");
  await createForm.getByLabel("Oda").selectOption("standart-oda");
  await createForm.getByLabel("Kayıt durumu").selectOption("confirmed");
  await createForm.getByLabel("Ad Soyad").fill(`Manuel Smoke ${iteration}`);
  await createForm.getByLabel("Telefon").fill("+90 555 300 40 50");

  const [createResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/reservations") && candidate.request().method() === "POST"),
    page.getByTestId("admin-create-reservation").click()
  ]);

  expect(createResponse.ok(), `Manual reservation create failed with ${createResponse.status()}`).toBeTruthy();
  await expect(page.getByText("Rezervasyon oluşturuldu.")).toBeVisible();
  await expect(page.locator(".admin-reservation-card").filter({ hasText: `Manuel Smoke ${iteration}` })).toBeVisible();
}

async function checkRooms(page) {
  await page.getByTestId("admin-tab-rooms").click();
  await expect(page.getByRole("heading", { level: 1, name: "Odalar" })).toBeVisible();
  await page.getByLabel("Fiyat").fill("₺1.234");
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  await expect(page.getByText("Galeri 2")).toBeVisible();
  await page.locator("button[title='Oda ekle']").click();
  await expect(page.getByRole("heading", { name: /Yeni Oda/ })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("selected-room-delete").click();
}

async function checkGallery(page, imagePath) {
  await page.getByTestId("admin-tab-gallery").click();
  await expect(page.getByRole("heading", { level: 1, name: "Galeri" })).toBeVisible();
  const galleryPickers = page.locator("div[data-testid^='image-picker-gallery-']");
  const pickerCountBeforeAdd = await galleryPickers.count();
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  await expect(galleryPickers).toHaveCount(pickerCountBeforeAdd + 1);
  await expect(page.locator("input[value='Yeni görsel']")).toBeVisible();
  const newPicker = page.getByTestId(`image-picker-gallery-${pickerCountBeforeAdd}`);
  await newPicker.scrollIntoViewIfNeeded();
  await uploadWithPickerRoot(page, newPicker, imagePath);
  await page.locator("button[title='Aşağı taşı']").first().click();
  await page.locator("button[title='Yukarı taşı']").first().click();
  await page.locator("button[title='Sil']").last().click();
}

async function checkServices(page) {
  await page.getByTestId("admin-tab-services").click();
  await expect(page.getByRole("heading", { level: 1, name: "Hizmetler" })).toBeVisible();
  await page.getByRole("button", { name: "Hizmet ekle" }).click();
  await page.locator(".admin-string-row input").last().fill("Smoke Hizmet");
  await page.getByRole("button", { name: "Özellik ekle" }).click();
  await page.getByLabel("Başlık").last().fill("Smoke Özellik");
  await page.getByLabel("Açıklama").last().fill("Smoke özellik açıklaması.");
}

async function checkSettings(page, imagePath) {
  await page.getByTestId("admin-tab-settings").click();
  await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
  const security = page.getByTestId("admin-section-security");
  await security.getByLabel("Mevcut şifre").fill(adminPassword);
  await security.getByLabel("Yeni şifre", { exact: true }).fill(changedAdminPassword);
  await security.getByLabel("Yeni şifre tekrar").fill(changedAdminPassword);

  const [passwordResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/password") && candidate.request().method() === "POST"),
    page.getByTestId("admin-change-password").click()
  ]);

  expect(passwordResponse.ok(), `Password change failed with ${passwordResponse.status()}`).toBeTruthy();
  await expect(page.getByText("Admin şifresi değiştirildi.")).toBeVisible();
  await page.getByLabel("Telefon", { exact: true }).fill("+90 452 000 00 00");
  await page.getByLabel("WhatsApp", { exact: true }).fill("+90 555 000 00 00");
  await page.getByLabel("Tarihçe başlığı").fill("Smoke Tarihçe");
  await uploadWithPicker(page, "image-picker-history", imagePath);
}

async function checkImages(page, imagePath, invalidImagePath) {
  await page.getByTestId("admin-tab-images").click();
  await expect(page.getByRole("heading", { level: 1, name: "Görseller" })).toBeVisible();
  await uploadToLibrary(page, imagePath);

  const [invalidResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/images") && candidate.request().method() === "POST"),
    page.getByTestId("image-library-upload").setInputFiles(invalidImagePath)
  ]);

  expect(invalidResponse.status(), "Invalid image upload should be rejected").toBe(400);
  await expect(page.getByText("Görsel yüklenemedi.")).toBeVisible();
}

async function saveAndVerify(page, iteration) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/content") && candidate.request().method() === "POST"),
    page.getByTestId("admin-save").click()
  ]);

  expect(response.ok(), `Content save failed with ${response.status()}`).toBeTruthy();
  await expect(page.getByText("Kaydedildi. Önceki içerik backup'a alındı.")).toBeVisible();

  const contentResult = await page.evaluate(async () => {
    const response = await fetch("/api/admin/content");
    return {
      ok: response.ok,
      status: response.status,
      json: await response.json()
    };
  });
  expect(contentResult.ok, `Content GET failed with ${contentResult.status}`).toBeTruthy();
  expect(contentResult.json.content.site.name).toBe(`Smoke Otel ${iteration}`);
}

async function logoutAndVerify(page) {
  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login/);

  const response = await page.request.get(`${baseURL}/api/admin/content`);
  expect(response.status()).toBe(401);

  const oldPasswordLogin = await page.request.post(`${baseURL}/api/admin/login`, {
    data: { password: adminPassword }
  });
  expect(oldPasswordLogin.status()).toBe(401);

  await loginOrSetup(page, changedAdminPassword);
  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

async function checkSecurityHeaders(page) {
  const response = await page.request.get(`${baseURL}/admin/login`);
  expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
}

async function runIteration(browser, iteration, imageA, imageB, invalidImage) {
  log(`iteration ${iteration}/${repeats} starting`);
  await resetSmokeData();

  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 }
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
  await checkPublicReservationValidation(page);
  await loginOrSetup(page);
  await checkOverview(page, imageA, iteration);
  await checkReservations(page, iteration);
  await checkRooms(page);
  await checkGallery(page, imageB);
  await checkServices(page);
  await checkSettings(page, imageA);
  await checkImages(page, imageB, invalidImage);
  await saveAndVerify(page, iteration);
  await logoutAndVerify(page);

  assert(pageErrors.length === 0, `Browser errors detected:\n${pageErrors.join("\n")}`);
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
  browser = await chromium.launch();

  for (let iteration = 1; iteration <= repeats; iteration += 1) {
    await runIteration(browser, iteration, imageA, imageB, invalidImage);
  }

  log("all admin smoke checks passed");
} finally {
  if (browser) {
    await browser.close();
  }

  await stopServer(server);
  await cleanupUploadedPublicFiles();
  await fs.rm(tmpRoot, { recursive: true, force: true });
}
