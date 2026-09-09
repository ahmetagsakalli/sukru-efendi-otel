import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  chooseBookingDate,
  chooseBookingOption,
} from "./booking-test-helpers.mjs";

// Run against a local server. Write endpoints are intercepted: no guest records are created.
const baseURL = process.env.BOOKING_SMOKE_URL || "http://127.0.0.1:3000";
const screenshotDir = process.env.BOOKING_SCREENSHOTS;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  extraHTTPHeaders: {
    "x-forwarded-for": `10.74.${Math.floor(Math.random() * 254) + 1}.1`,
  },
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const booking = page.locator("#rezervasyon");
const next = booking.getByRole("button", { name: "Devam edin", exact: true });
let writeCount = 0;
let reservationResult = "error";
let lastPayload;

await page.route("**/api/reservations", async (route) => {
  writeCount++;
  lastPayload = route.request().postDataJSON();
  if (reservationResult === "error") {
    return route.fulfill({
      status: 409,
      json: { error: "Test: oda az önce doldu, lütfen tekrar deneyin." },
    });
  }
  return route.fulfill({
    json: {
      ok: true,
      reservation: {
        id: "12345678-1234-4234-8234-123456789abc",
        status: "confirmed",
        totalLabel: "₺5.800",
      },
      payment: { required: reservationResult === "payment" },
    },
  });
});
await page.route("**/api/payments/create", (route) =>
  route.fulfill({
    json: { payment: { redirectUrl: `${baseURL}/odeme/test?smoke=1` } },
  }),
);
await page.route("**/odeme/test?smoke=1", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<h1>Payment redirect verified</h1>",
  }),
);

async function screenshot(name) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await booking.screenshot({ path: path.join(screenshotDir, name) });
}
function plusDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

try {
  await page.goto(baseURL);
  await expect(next).toBeEnabled({ timeout: 30000 });
  await expect(booking.locator('input[name="name"]')).toHaveCount(0);
  await screenshot("booking-desktop.png");
  const today = await booking.locator('[name="checkIn"]').inputValue();
  const arrival = plusDays(today, 5);
  await chooseBookingDate(page, "checkIn", arrival);
  await expect(booking.locator('[name="checkOut"]')).toHaveValue(
    plusDays(arrival, 1),
  );
  await chooseBookingDate(page, "checkOut", plusDays(arrival, 2));
  await chooseBookingOption(page, "Odanız", "Aile Odaları");
  await chooseBookingOption(page, "Yetişkin", "4");
  await booking.getByRole("combobox", { name: "Çocuk", exact: true }).click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await chooseBookingOption(page, "Odanız", "Standart Oda");
  await expect(
    booking.getByRole("combobox", { name: "Yetişkin", exact: true }),
  ).toHaveText("4");
  await expect(next).toBeDisabled();
  await expect(booking).toContainText("en fazla 3 misafirimizi");
  await chooseBookingOption(page, "Yetişkin", "3");
  await expect(next).toBeEnabled();
  await expect(booking).toContainText("₺5.800");
  await next.click();
  await expect(booking.getByRole("heading")).toBeFocused();
  const submit = booking.getByRole("button", {
    name: "Rezervasyonunuzu tamamlayın",
    exact: true,
  });
  await submit.click();
  expect(writeCount).toBe(0);
  await booking.locator('[name="name"]').fill("Test Misafir");
  await booking.locator('[name="phone"]').fill("+90 (555) 123-45-67");
  await booking.locator('[name="email"]').fill("misafir@example.com");
  await booking.locator("summary").click();
  await booking.locator('[name="note"]').fill("Test konaklama notu");
  await expect(booking.locator("form")).toHaveJSProperty("noValidate", false);
  expect(
    await booking
      .locator('[name="phone"]')
      .evaluate((input) => input.checkValidity()),
  ).toBe(true);
  await booking
    .getByRole("button", { name: "Seçimlerinizi değiştirin", exact: true })
    .click();
  await next.click();
  await expect(booking.locator('[name="name"]')).toHaveValue("Test Misafir");
  await screenshot("booking-details-desktop.png");
  await submit.click();
  await expect(booking.getByRole("alert")).toContainText("oda az önce doldu");
  await expect(booking.locator('[name="phone"]')).toHaveValue(
    "+90 (555) 123-45-67",
  );
  reservationResult = "success";
  await submit.click();
  await expect(booking.getByRole("heading")).toHaveText("Sizi bekliyoruz.");
  expect(lastPayload).toMatchObject({
    checkIn: arrival,
    checkOut: plusDays(arrival, 2),
    roomSlug: "standart-oda",
    adults: 3,
    children: 0,
    name: "Test Misafir",
    email: "misafir@example.com",
    note: "Test konaklama notu",
    website: "",
  });
  console.log(
    "PASS: live pricing, date adjustment, room capacity, required fields, preserved guest details, submission error and success.",
  );

  await booking
    .getByRole("button", { name: "Yeni bir rezervasyon yapın" })
    .click();
  await expect(next).toBeEnabled();
  await booking.locator('button[data-booking-date="checkIn"]').click();
  const yesterday = page
    .getByRole("dialog")
    .locator(`[data-day="${plusDays(today, -1)}"] button`);
  if (await yesterday.count()) await expect(yesterday).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(next).toBeEnabled();

  let failAvailability = true;
  await page.route("**/api/availability?**", async (route) => {
    if (failAvailability)
      return route.fulfill({
        status: 503,
        json: { error: "Müsaitlik bilgisi alınamadı." },
      });
    return route.continue();
  });
  await chooseBookingDate(page, "checkOut", plusDays(arrival, 3));
  await expect(
    booking.getByRole("button", { name: "Tekrar deneyin" }),
  ).toBeVisible();
  await expect(next).toBeDisabled();
  failAvailability = false;
  await booking.getByRole("button", { name: "Tekrar deneyin" }).click();
  await expect(next).toBeEnabled();
  await page.unroute("**/api/availability?**");
  console.log(
    "PASS: invalid dates and availability failure block progression; retry recovers.",
  );

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await booking.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    const buttonBox = await next.boundingBox();
    expect(buttonBox.x).toBeGreaterThanOrEqual(0);
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(width);
    if (width === 390) {
      await screenshot("booking-mobile.png");
      await next.click();
      await screenshot("booking-details-mobile.png");
      await booking
        .getByRole("button", { name: "Seçimlerinizi değiştirin", exact: true })
        .click();
    }
  }
  console.log("PASS: responsive layout at 320, 390, 768, 1024 and 1440 px.");

  for (const [route, title, continueLabel] of [
    ["/en", "We would love to welcome you.", "Continue"],
    ["/de", "Wir heißen Sie herzlich willkommen.", "Weiter"],
  ]) {
    await page.goto(`${baseURL}${route}`);
    await expect(booking.getByRole("heading")).toHaveText(title);
    await expect(
      booking.getByRole("button", { name: continueLabel, exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    expect(
      await booking.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.goto(`${baseURL}/rezervasyon?room=suit-oda&adults=8&children=8`);
  await expect(booking.locator('[name="adults"]')).toHaveValue("8");
  await expect(booking.locator('[name="children"]')).toHaveValue("8");
  await expect(booking).toContainText("en fazla 3 misafirimizi");
  await expect(next).toBeDisabled();
  await chooseBookingDate(page, "checkIn", arrival);
  await chooseBookingOption(page, "Odanız", "Aile Odaları");
  await expect(booking.locator('[name="adults"]')).toHaveValue("8");
  await expect(booking.locator('[name="children"]')).toHaveValue("8");
  await chooseBookingOption(page, "Yetişkin", "2");
  await chooseBookingOption(page, "Çocuk", "2");
  await expect(next).toBeEnabled();
  await expect(booking).toContainText("4 misafir");
  console.log(
    "PASS: expanded guest ranges, preserved selections and capacity validation; two adults and two children can book a family room.",
  );

  await page.goto(
    `${baseURL}/rezervasyon?checkIn=${arrival}&checkOut=${plusDays(arrival, 2)}&room=standart-oda&adults=1`,
  );
  await expect(next).toBeEnabled({ timeout: 30000 });
  await expect(booking.locator('[name="checkIn"]')).toHaveValue(arrival);
  await expect(booking.locator('[name="adults"]')).toHaveValue("1");
  reservationResult = "payment";
  await next.click();
  await booking.locator('[name="name"]').fill("Ödeme Test");
  await booking.locator('[name="phone"]').fill("05551234567");
  await booking
    .getByRole("button", { name: "Rezervasyonunuzu tamamlayın", exact: true })
    .click();
  await expect(page).toHaveURL(/odeme\/test\?smoke=1/);
  expect(pageErrors).toEqual([]);
  console.log(
    "PASS: English/German pages, booking URL prefill, optional email and payment redirect; no browser errors.",
  );
} finally {
  await browser.close();
}
